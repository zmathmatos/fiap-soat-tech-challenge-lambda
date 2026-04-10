import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({ region: process.env.AWS_REGION || "us-east-1" });

const parameterCache = new Map<string, string>();

export async function getSSMParameter(name: string): Promise<string> {
  const cached = parameterCache.get(name);
  if (cached) {
    return cached;
  }

  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  const value = response.Parameter?.Value;

  if (!value) {
    throw new Error(`SSM parameter ${name} not found`);
  }

  parameterCache.set(name, value);
  return value;
}
