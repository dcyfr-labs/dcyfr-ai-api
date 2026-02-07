/**
 * Basic API Client Example
 * 
 * Demonstrates how to interact with the DCYFR API using fetch
 */

const API_BASE_URL = 'http://localhost:3001';

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Register a new user
 */
async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }

  return response.json();
}

/**
 * Login with existing credentials
 */
async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  return response.json();
}

/**
 * Fetch user profile with JWT token
 */
async function getProfile(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch profile');
  }

  return response.json();
}

/**
 * Example usage
 */
async function main() {
  try {
    // 1. Register a new user
    console.log('Registering new user...');
    const { token, user } = await register({
      email: 'user@example.com',
      password: 'secure_password_123',
      name: 'John Doe',
    });

    console.log('Registered:', user);
    console.log('Token:', token);

    // 2. Fetch user profile
    console.log('\nFetching profile...');
    const profile = await getProfile(token);
    console.log('Profile:', profile);

    // 3. Login with existing user
    console.log('\nLogging in...');
    const loginResponse = await login({
      email: 'user@example.com',
      password: 'secure_password_123',
    });

    console.log('Logged in:', loginResponse.user);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { register, login, getProfile };
