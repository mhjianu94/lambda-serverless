import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcrypt';
import { getDataSource } from '../data-source';
import { User } from '../entity/User';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const SALT_ROUNDS = 10;

function toUserDto(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function parseBody(event: APIGatewayProxyEvent): { email?: string; password?: string } {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body) as { email?: string; password?: string };
  } catch {
    return {};
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    return await handleUsersWriteImpl(event);
  } catch (err) {
    console.error('users-write error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

async function handleUsersWriteImpl(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const ds = await getDataSource();
  const repo = ds.getRepository(User);
  const method = event.httpMethod;
  const id = event.pathParameters?.id;

  if (method === 'POST' && !id) {
    const body = parseBody(event);
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'email and password are required' }),
      };
    }
    if (!isValidEmail(email)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'invalid email format' }),
      };
    }
    if (password.length < 8) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'password must be at least 8 characters' }),
      };
    }
    const existing = await repo.findOneBy({ email });
    if (existing) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'email already in use' }),
      };
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = repo.create({ email, passwordHash });
    await repo.save(user);
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(toUserDto(user)),
    };
  }

  if (method === 'PUT' && id) {
    const user = await repo.findOneBy({ id });
    if (!user) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }
    const body = parseBody(event);
    if (typeof body.email === 'string' && body.email.trim()) {
      const email = body.email.trim();
      if (!isValidEmail(email)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'invalid email format' }),
        };
      }
      const existing = await repo.findOneBy({ email });
      if (existing && existing.id !== id) {
        return {
          statusCode: 409,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'email already in use' }),
        };
      }
      user.email = email;
    }
    if (typeof body.password === 'string' && body.password.length >= 8) {
      user.passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    }
    await repo.save(user);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(toUserDto(user)),
    };
  }

  return {
    statusCode: 400,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Bad request' }),
  };
}
