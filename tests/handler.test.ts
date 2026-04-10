import { handler } from "../src/handler";
import { APIGatewayProxyEvent } from "aws-lambda";
import * as userRepository from "../src/database/user-repository";
import * as tokenService from "../src/auth/token-service";

jest.mock("../src/database/user-repository");
jest.mock("../src/auth/token-service");

const mockFindUser = userRepository.findUserByDocument as jest.MockedFunction<
  typeof userRepository.findUserByDocument
>;
const mockGenerateToken = tokenService.generateToken as jest.MockedFunction<
  typeof tokenService.generateToken
>;

const createEvent = (body: object): APIGatewayProxyEvent =>
  ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: "POST",
    isBase64Encoded: false,
    path: "/auth",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: "",
  } as APIGatewayProxyEvent);

describe("Lambda Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("should return 400 when CPF is missing", async () => {
    const result = await handler(createEvent({}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("CPF is required");
  });

  it("should return 400 for invalid CPF", async () => {
    const result = await handler(createEvent({ cpf: "12345678900" }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("Invalid CPF format");
  });

  it("should return 404 when user not found", async () => {
    mockFindUser.mockResolvedValue(null);
    const result = await handler(createEvent({ cpf: "52998224725" }));
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe("User not found");
  });

  it("should return 200 with token for valid CPF", async () => {
    mockFindUser.mockResolvedValue({
      id: "uuid-123",
      name: "Test User",
      document: "52998224725",
      email: "test@test.com",
      role: "customer",
    });
    mockGenerateToken.mockReturnValue("jwt-token-123");

    const result = await handler(createEvent({ cpf: "52998224725" }));
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.token).toBe("jwt-token-123");
    expect(body.user.id).toBe("uuid-123");
    expect(body.user.email).toBe("test@test.com");
  });
});
