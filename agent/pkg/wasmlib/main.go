//go:build js && wasm
// +build js,wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/typeeng/tight-agent/pkg/celutils"
	"github.com/typeeng/tight-agent/pkg/schemas"
	"google.golang.org/protobuf/reflect/protoreflect"
)

var (
	defaultSchemaGlob = "public.*"
	schemaPbPkgName   = "db"
)

type PostgresqlTableSchema = schemas.PostgresqlTableSchema
type PostgresqlTableSchemaList = schemas.PostgresqlTableSchemaList

type CELValidators []CELValidator

func convertGoStringSliceToJSArray(slice []string) js.Value {
	jsArray := js.Global().Get("Array").New()
	for _, item := range slice {
		jsArray.Call("push", item)
	}
	return jsArray
}

func (validators CELValidators) ToJSValue() js.Value {
	jsArray := js.Global().Get("Array").New()

	for _, v := range validators {
		jsMap := js.Global().Get("Object").New()
		jsMap.Set("table", v.Table)
		jsMap.Set("operation", v.Operation)
		jsMap.Set("exprKind", v.ExprKind)
		jsMap.Set("expr", v.Expr)
		jsMap.Set("events", convertGoStringSliceToJSArray(v.Events))
		jsMap.Set("valid", v.Valid)
		jsMap.Set("validationError", v.Error)
		jsArray.Call("push", jsMap)
	}

	return jsArray
}

type CELValidator struct {
	Table     string   `json:"table"`
	Operation string   `json:"operation"`
	ExprKind  string   `json:"exprKind"`
	Expr      string   `json:"expr"`
	Events    []string `json:"events"`

	Valid bool   `json:"valid"`
	Error string `json:"validationError"`
}

func (validator *CELValidator) CheckInput() error {
	if len(validator.Table) < 1 {
		return fmt.Errorf("missing table name")
	}
	if validator.Operation != "insert" && validator.Operation != "update" && validator.Operation != "delete" {
		return fmt.Errorf("invalid operation name: %s", validator.Operation)
	}
	if validator.ExprKind != "cond" && validator.ExprKind != "prop" {
		return fmt.Errorf("invalid expression kind: %s", validator.ExprKind)
	}
	if len(validator.Expr) < 1 {
		return fmt.Errorf("missing expression to validate")
	}
	return nil
}

func (validator *CELValidator) RunValidation(schemaPb protoreflect.FileDescriptor) {
	err := validator.CheckInput()
	if err != nil {
		validator.Valid = false
		validator.Error = fmt.Sprintf("%v", err)
		return
	}
	baseEnvOpts := celutils.GenerateBaseCELEnvOptions(&schemaPbPkgName, schemaPb, validator.Table, validator.Operation)
	if validator.ExprKind == "prop" {
		env, err := celutils.CreateCELEnv(baseEnvOpts...)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
		_, err = celutils.CompilePropertyExpression(env, validator.Expr)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
	} else if validator.ExprKind == "cond" {
		eventsEnvOpts, err := celutils.GenerateCELEventsOptions(validator.Events)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
		env, err := celutils.CreateCELEnv(append(baseEnvOpts, eventsEnvOpts...)...)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
		_, err = celutils.CompileEventCondition(env, validator.Expr)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
	} else {
		validator.Valid = false
		validator.Error = fmt.Sprintf("invalid expression kind: %v", validator.ExprKind)
		return
	}
	validator.Valid = true
	validator.Error = ""
}

func convertJSArrayToStrings(jsArray js.Value) []string {
	if !jsArray.Truthy() {
		return nil
	}
	length := jsArray.Length()
	result := make([]string, length)
	for i := 0; i < length; i++ {
		result[i] = jsArray.Index(i).String()
	}
	return result
}

func main() {
	done := make(chan struct{}, 0)
	global := js.Global()

	var currentSchemaPb protoreflect.FileDescriptor

	// Input: { schema: Array | null }
	// The schema is a JavaScript array that contains the schema of the database returned by the introspection query
	global.Set("wasmlibSetSchema", js.FuncOf(func(_ js.Value, outerArgs []js.Value) any {
		handler := js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			resolve := args[0]
			reject := args[1]

			go func() {
				if len(outerArgs) != 1 {
					reject.Invoke(js.Global().Get("Error").New("expected exactly one argument"))
					return
				}

				schemaArg := outerArgs[0]
				if schemaArg.IsNull() {
					currentSchemaPb = nil
					resolve.Invoke(js.Null())
					return
				}

				if !schemaArg.Truthy() {
					reject.Invoke(js.Global().Get("Error").New("schema is required to be an array or null"))
					return
				}

				if schemaArg.Type() != js.TypeObject || !schemaArg.InstanceOf(js.Global().Get("Array")) {
					reject.Invoke(js.Global().Get("Error").New("schema must be an array"))
					return
				}

				// Convert JS array to Go slice
				var schemas PostgresqlTableSchemaList
				schemaArgAsStr := js.Global().Get("JSON").Call("stringify", schemaArg)
				err := json.Unmarshal([]byte(schemaArgAsStr.String()), &schemas)
				if err != nil {
					reject.Invoke(js.Global().Get("Error").New(fmt.Sprintf("failed to parse schema: %v", err)))
					return
				}

				currentSchemaPb, err = schemas.GeneratePbDescriptorForTables(schemaPbPkgName, defaultSchemaGlob)
				if err != nil {
					reject.Invoke(js.Global().Get("Error").New(fmt.Sprintf("failed to generate protobuf descriptor: %v", err)))
					return
				}

				resolve.Invoke(js.Null())
			}()

			return nil
		})

		return js.Global().Get("Promise").New(handler)
	}))

	// Input: { cels: [{ table: string, operation: string, exprKind: string, expr: string }] }
	global.Set("wasmlibValidateCELs", js.FuncOf(func(_ js.Value, outerArgs []js.Value) any {
		handler := js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			resolve := args[0]
			reject := args[1]

			go func() {
				if len(outerArgs) != 1 {
					reject.Invoke(js.Global().Get("Error").New("expected exactly one argument"))
					return
				}

				input := outerArgs[0]
				if !input.Truthy() {
					reject.Invoke(js.Global().Get("Error").New("input object is required"))
					return
				}

				cels := input.Get("cels")
				if !cels.Truthy() {
					reject.Invoke(js.Global().Get("Error").New("cels array is required"))
					return
				}

				celsLen := cels.Length()
				celsDest := make(CELValidators, 0, celsLen)

				for i := 0; i < celsLen; i++ {
					cel := cels.Index(i)
					celValidator := CELValidator{
						Table:     cel.Get("table").String(),
						Operation: cel.Get("operation").String(),
						ExprKind:  cel.Get("exprKind").String(),
						Expr:      cel.Get("expr").String(),
						Events:    convertJSArrayToStrings(cel.Get("events")),
					}
					celValidator.RunValidation(currentSchemaPb)
					celsDest = append(celsDest, celValidator)
				}

				resolve.Invoke(celsDest.ToJSValue())
			}()

			return nil
		})

		return js.Global().Get("Promise").New(handler)
	}))
	<-done
}
