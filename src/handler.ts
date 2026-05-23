import { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
import { validateDocument } from "./validators/document-validator";
import { findUserByDocument } from "./database/user-repository";
import { generateToken } from "./auth/token-service";

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<{ isAuthorized: boolean; context?: Record<string, string> }> => {
  try {
    const document = event.headers?.["x-document"];

    if (!document) {
      return { isAuthorized: false };
    }

    const cleanDocument = document.replace(/\D/g, "");

    if (!validateDocument(cleanDocument)) {
      return { isAuthorized: false };
    }

    const user = await findUserByDocument(cleanDocument);

    if (!user) {
      return { isAuthorized: false };
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      isAuthorized: true,
      context: {
        jwt: token,
        userId: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Authorization error:", error);
    return { isAuthorized: false };
  }
};
