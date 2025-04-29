//go:build js && wasm
// +build js,wasm

package main

import (
	"errors"
	"fmt"
	"syscall/js"

	"github.com/typeeng/tight-agent/pkg/celutils"
)

type CELValidators []CELValidator

func (validators CELValidators) ToJSValue() js.Value {
	jsArray := js.Global().Get("Array").New()

	for _, v := range validators {
		jsMap := js.Global().Get("Object").New()
		jsMap.Set("table", v.Table)
		jsMap.Set("operation", v.Operation)
		jsMap.Set("exprKind", v.ExprKind)
		jsMap.Set("expr", v.Expr)
		jsMap.Set("valid", v.Valid)
		jsMap.Set("validationError", v.Error)
		jsArray.Call("push", jsMap)
	}

	return jsArray
}

type CELValidator struct {
	Table     string `json:"table"`
	Operation string `json:"operation"`
	ExprKind  string `json:"exprKind"`
	Expr      string `json:"expr"`

	Valid bool   `json:"valid"`
	Error string `json:"validationError"`
}

func (validator *CELValidator) CheckInput() error {
	if len(validator.Table) < 1 {
		return errors.New("missing table name")
	}
	if validator.Operation != "insert" && validator.Operation != "update" && validator.Operation != "delete" {
		return errors.New(fmt.Sprintf("invalid operation name: %s", validator.Operation))
	}
	if validator.ExprKind != "cond" && validator.ExprKind != "prop" {
		return errors.New(fmt.Sprintf("invalid expression kind: %s", validator.ExprKind))
	}
	if len(validator.Expr) < 1 {
		return errors.New("missing expression to validate")
	}
	return nil
}

func (validator *CELValidator) RunValidation(schema any) {
	err := validator.CheckInput()
	if err != nil {
		validator.Valid = false
		validator.Error = fmt.Sprintf("%v", err)
		return
	}
	env, err := celutils.CreateCELEnv(validator.Table, validator.Operation)
	if err != nil {
		validator.Valid = false
		validator.Error = fmt.Sprintf("%v", err)
		return
	}
	if validator.ExprKind == "cond" {
		_, err := celutils.CompileEventCondition(validator.Expr, env)
		if err != nil {
			validator.Valid = false
			validator.Error = fmt.Sprintf("%v", err)
			return
		}
	} else if validator.ExprKind == "prop" {
		_, err := celutils.CompilePropertyExpression(validator.Expr, env)
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

func main() {
	done := make(chan struct{}, 0)
	global := js.Global()

	// Input: { schema: any, cels: [{ table: string, operation: string, exprKind: string, expr: string }] }
	global.Set("wasmlibValidateCELs", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 {
			return js.ValueOf("Error: expected exactly one argument")
		}

		input := args[0]
		if !input.Truthy() {
			return js.ValueOf("Error: input object is required")
		}

		schema := input.Get("schema")
		cels := input.Get("cels")

		if !cels.Truthy() {
			return js.ValueOf("Error: cels array is required")
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
			}
			celValidator.RunValidation(schema)
			celsDest = append(celsDest, celValidator)
		}

		return celsDest.ToJSValue()
	}))
	<-done
}
