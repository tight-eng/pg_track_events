package celutils

import (
	"fmt"

	"github.com/google/cel-go/cel"
)

var (
	newVar = cel.Variable("new", cel.MapType(cel.StringType, cel.DynType))
	oldVar = cel.Variable("old", cel.MapType(cel.StringType, cel.DynType))
)

// compileCELExpression compiles a CEL expression with the given environment
func compileCELExpression(expr string, env *cel.Env) (cel.Program, error) {
	ast, issues := env.Compile(expr)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("CEL compilation error: %w", issues.Err())
	}

	prg, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("CEL program creation error: %w", err)
	}

	return prg, nil
}

// CompileEventCondition compiles a CEL expression that must evaluate to a boolean value.
// This is used for event conditions that determine whether an event should be processed.
func CompileEventCondition(expr string, env *cel.Env) (cel.Program, error) {
	ast, issues := env.Compile(expr)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("CEL compilation error: %w", issues.Err())
	}

	// Verify the expression returns a boolean
	if ast.OutputType() != cel.BoolType {
		return nil, fmt.Errorf("event condition must return a boolean value, got %v", ast.OutputType())
	}

	prg, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("CEL program creation error: %w", err)
	}

	return prg, nil
}

// CompilePropertyExpression compiles a CEL expression that can return any value type.
// This is used for property expressions that can return any valid CEL type.
func CompilePropertyExpression(expr string, env *cel.Env) (cel.Program, error) {
	return compileCELExpression(expr, env)
}

// CreateCELEnv creates a CEL environment with common declarations
func CreateCELEnv(tableName string, op string) (*cel.Env, error) {
	// Create base declarations
	envOpts := []cel.EnvOption{
		cel.Variable(tableName, cel.MapType(cel.StringType, cel.DynType)),
	}

	// Add new/old based on event type
	switch op {
	case "insert":
		envOpts = append(envOpts, newVar)
	case "update":
		envOpts = append(envOpts, newVar, oldVar)
	case "delete":
		envOpts = append(envOpts, oldVar)
	}

	return cel.NewEnv(envOpts...)
}
