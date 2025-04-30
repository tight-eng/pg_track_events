package celutils

import (
	"fmt"

	"github.com/google/cel-go/cel"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
)

var (
	eventRefsPbPkgName = "__event_refs"
	eventRefsPbFdName  = "__event_refs.proto"
	eventRefPbTypeName = "EventRef"

	newVarDyn = cel.Variable("new", cel.MapType(cel.StringType, cel.DynType))
	oldVarDyn = cel.Variable("old", cel.MapType(cel.StringType, cel.DynType))
)

// compileCELExpression compiles a CEL expression with the given environment
func compileCELExpression(env *cel.Env, expr string) (cel.Program, error) {
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

// CompileEventCondition compiles a CEL expression that returns a valid event reference.
func CompileEventCondition(env *cel.Env, expr string) (cel.Program, error) {
	ast, issues := env.Compile(expr)
	if issues != nil && issues.Err() != nil {
		return nil, fmt.Errorf("CEL compilation error: %w", issues.Err())
	}

	// Verify the expression returns one of the valid event references
	if ast.OutputType().TypeName() != fmt.Sprintf("%s.%s", eventRefsPbPkgName, eventRefPbTypeName) {
		return nil, fmt.Errorf("event condition must return a valid event reference, got %v", ast.OutputType())
	}

	prg, err := env.Program(ast)
	if err != nil {
		return nil, fmt.Errorf("CEL program creation error: %w", err)
	}

	return prg, nil
}

// CompilePropertyExpression compiles a CEL expression that can return any value type.
// This is used for property expressions that can return any valid CEL type.
func CompilePropertyExpression(env *cel.Env, expr string) (cel.Program, error) {
	return compileCELExpression(env, expr)
}

func CreateCELEnv(envOpts ...cel.EnvOption) (*cel.Env, error) {
	env, err := cel.NewEnv(envOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create CEL environment: %w", err)
	}
	return env, nil
}

func GenerateCELEventsOptions(events []string) ([]cel.EnvOption, error) {
	// Create a new file descriptor proto for the EventRef type
	f := &descriptorpb.FileDescriptorProto{
		Name:    proto.String(eventRefsPbFdName),
		Syntax:  proto.String("proto3"),
		Package: proto.String(eventRefsPbPkgName),
	}

	// Create the EventRef message type
	eventRefMsg := &descriptorpb.DescriptorProto{
		Name: proto.String(eventRefPbTypeName),
		Field: []*descriptorpb.FieldDescriptorProto{
			{
				Name:   proto.String("value"),
				Number: proto.Int32(1),
				Type:   descriptorpb.FieldDescriptorProto_TYPE_STRING.Enum(),
			},
		},
	}

	// Create the Events wrapper message type
	eventsMsg := &descriptorpb.DescriptorProto{
		Name: proto.String("Events"),
	}

	// Add fields for each event
	for i, event := range events {
		field := &descriptorpb.FieldDescriptorProto{
			Name:     proto.String(event),
			Number:   proto.Int32(int32(i + 1)),
			Type:     descriptorpb.FieldDescriptorProto_TYPE_MESSAGE.Enum(),
			TypeName: proto.String(fmt.Sprintf("%s.%s", eventRefsPbPkgName, eventRefPbTypeName)),
		}
		eventsMsg.Field = append(eventsMsg.Field, field)
	}

	// Add both message types to the file descriptor
	f.MessageType = append(f.MessageType, eventRefMsg, eventsMsg)

	// Create the file descriptor
	fd, err := protodesc.NewFile(f, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create file descriptor: %w", err)
	}

	// Create CEL environment options
	var envOpts []cel.EnvOption
	envOpts = append(envOpts, cel.TypeDescs(fd))
	envOpts = append(envOpts, cel.Variable("events", cel.ObjectType(fmt.Sprintf("%s.%s", eventRefsPbPkgName, *eventsMsg.Name))))

	return envOpts, nil
}

// CreateCELEnv creates a CEL environment with common declarations
func GenerateBaseCELEnvOptions(pbPkgName *string, pbFd protoreflect.FileDescriptor, tableName string, op string) []cel.EnvOption {
	// Create base declarations
	var envOpts []cel.EnvOption
	var newVar, oldVar cel.EnvOption
	if pbPkgName != nil && pbFd != nil {
		rowObjType := cel.ObjectType(fmt.Sprintf("%s.%s", *pbPkgName, tableName))
		envOpts = []cel.EnvOption{
			cel.TypeDescs(pbFd),
			cel.Variable(tableName, rowObjType),
		}
		newVar = cel.Variable("new", rowObjType)
		oldVar = cel.Variable("old", rowObjType)
	} else {
		envOpts = []cel.EnvOption{
			cel.Variable(tableName, cel.MapType(cel.StringType, cel.DynType)),
		}
		newVar = newVarDyn
		oldVar = oldVarDyn
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

	return envOpts
}
