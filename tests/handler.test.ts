import { handler } from "../src/handler";
import { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
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

const createEvent = (document?: string): APIGatewayRequestAuthorizerEventV2 =>
  ({
    version: "2.0",
    type: "REQUEST",
    routeArn:
      "arn:aws:execute-api:us-east-1:123456789012:api-id/$default/ANY/customer/service-orders",
    identitySource: document ? [document] : [],
    routeKey: "ANY /customer/{proxy+}",
    rawPath: "/customer/service-orders",
    rawQueryString: "",
    headers: document ? { "x-document": document } : {},
    cookies: [],
    queryStringParameters: {},
    pathParameters: { proxy: "orders" },
    stageVariables: {},
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "api-id.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "api-id",
      http: {
        method: "GET",
        path: "/customer/service-orders",
        protocol: "HTTP/1.1",
        sourceIp: "1.2.3.4",
        userAgent: "test",
      },
      requestId: "test-request-id",
      routeKey: "ANY /customer/{proxy+}",
      stage: "$default",
      time: "01/Jan/2024:00:00:00 +0000",
      timeEpoch: 1704067200000,
    },
  } as APIGatewayRequestAuthorizerEventV2);

describe("Lambda Authorizer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("should deny when x-document header is missing", async () => {
    const result = await handler(createEvent());
    expect(result.isAuthorized).toBe(false);
  });

  it("should deny for invalid CPF", async () => {
    const result = await handler(createEvent("12345678900"));
    expect(result.isAuthorized).toBe(false);
  });

  it("should deny when user not found", async () => {
    mockFindUser.mockResolvedValue(null);
    const result = await handler(createEvent("52998224725"));
    expect(result.isAuthorized).toBe(false);
  });

  it("should authorize and return JWT context for valid CPF", async () => {
    mockFindUser.mockResolvedValue({
      id: "uuid-123",
      name: "Test User",
      document: "52998224725",
      email: "test@test.com",
      role: "customer",
    });
    mockGenerateToken.mockReturnValue("jwt-token-123");

    const result = await handler(createEvent("52998224725"));
    expect(result.isAuthorized).toBe(true);
    expect(result.context?.jwt).toBe("jwt-token-123");
    expect(result.context?.userId).toBe("uuid-123");
    expect(result.context?.email).toBe("test@test.com");
  });

  it ("should authorize and return JWT context for valid CNPJ", async () => {
    mockFindUser.mockResolvedValue({
      id: "uuid-456",
      name: "Test Company",
      document: "11222333000181",
      email: "test.company@email.com",
      role: "customer",
    });
    mockGenerateToken.mockReturnValue("jwt-token-456");

    const result = await handler(createEvent("11222333000181"));
    expect(result.isAuthorized).toBe(true);
    expect(result.context?.jwt).toBe("jwt-token-456");
    expect(result.context?.userId).toBe("uuid-456");
    expect(result.context?.email).toBe("test.company@email.com");
  });
});
