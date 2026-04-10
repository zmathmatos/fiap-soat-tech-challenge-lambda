import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { validateCPF } from "./validators/cpf-validator";
import { findUserByDocument } from "./database/user-repository";
import { generateToken } from "./auth/token-service";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { cpf } = body;

    if (!cpf) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "CPF is required" }),
      };
    }

    const cleanCPF = cpf.replace(/\D/g, "");

    if (!validateCPF(cleanCPF)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid CPF format" }),
      };
    }

    const user = await findUserByDocument(cleanCPF);

    if (!user) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      }),
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
