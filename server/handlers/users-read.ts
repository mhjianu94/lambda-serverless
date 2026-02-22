import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDataSource } from '../data-source';
import { User } from '../entity/User';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function toUserDto(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const ds = await getDataSource();
    const repo = ds.getRepository(User);

    const id = event.pathParameters?.id;

    if (id) {
      const user = await repo.findOneBy({ id });
      if (!user) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(toUserDto(user)),
      };
    }

    const users = await repo.find({ order: { createdAt: 'ASC' } });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(users.map(toUserDto)),
    };
  } catch (err) {
    console.error('users-read error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
