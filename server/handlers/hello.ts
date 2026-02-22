import { APIGatewayProxyResult } from 'aws-lambda';

export async function handler(): Promise<APIGatewayProxyResult> {
  const body = {
    message: 'Hello from AWS Lambda! sss ',
  };
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
