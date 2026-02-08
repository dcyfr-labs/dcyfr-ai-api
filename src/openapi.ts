/**
 * OpenAPI specification
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DCYFR AI API',
    description: 'Production-ready REST API template with Express 5, TypeScript, Drizzle ORM, and JWT authentication. Features comprehensive error handling, request validation, database migrations, and 98.54% test coverage.',
    version: '0.1.1',
    contact: {
      name: 'DCYFR',
      email: 'hello@dcyfr.ai',
      url: 'https://www.dcyfr.ai',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    { url: '/api', description: 'API base' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check API health status and uptime',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  status: 'ok',
                  timestamp: '2026-02-08T12:00:00.000Z',
                  uptime: 3600.5,
                  environment: 'development',
                  services: {
                    database: 'healthy',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description: 'Create a new user account and receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
              example: {
                email: 'alice@example.com',
                name: 'Alice Smith',
                password: 'SecurePassword123!',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
                example: {
                  user: {
                    id: 1,
                    email: 'alice@example.com',
                    name: 'Alice Smith',
                    role: 'user',
                    createdAt: '2026-02-08T10:30:00Z',
                    updatedAt: '2026-02-08T10:30:00Z',
                  },
                  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDQ5MTQwMCwiZXhwIjoxNzcxMDk2MjAwfQ...',
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: [
                      { path: 'body.password', message: 'String must contain at least 8 character(s)' },
                    ],
                  },
                },
              },
            },
          },
          409: {
            description: 'Email already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'CONFLICT',
                    message: "User with email 'alice@example.com' already exists",
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Authenticate with email and password to receive JWT token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: {
                email: 'alice@example.com',
                password: 'SecurePassword123!',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
                example: {
                  user: {
                    id: 1,
                    email: 'alice@example.com',
                    name: 'Alice Smith',
                    role: 'user',
                    createdAt: '2026-02-08T10:30:00Z',
                    updatedAt: '2026-02-08T10:30:00Z',
                  },
                  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid email or password',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users',
        description: 'Retrieve list of all users (admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of users',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UsersListResponse' },
                example: {
                  data: [
                    {
                      id: 1,
                      email: 'admin@example.com',
                      name: 'Admin User',
                      role: 'admin',
                      createdAt: '2026-02-08T09:00:00Z',
                      updatedAt: '2026-02-08T09:00:00Z',
                    },
                    {
                      id: 2,
                      email: 'user@example.com',
                      name: 'Regular User',
                      role: 'user',
                      createdAt: '2026-02-08T10:00:00Z',
                      updatedAt: '2026-02-08T10:00:00Z',
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - missing or invalid token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid or expired token',
                  },
                },
              },
            },
          },
          403: {
            description: 'Forbidden - insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        description: 'Retrieve user details by ID (authenticated users)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: 'User details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserResponse' },
                example: {
                  data: {
                    id: 1,
                    email: 'user@example.com',
                    name: 'Regular User',
                    role: 'user',
                    createdAt: '2026-02-08T10:00:00Z',
                    updatedAt: '2026-02-08T10:00:00Z',
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request - invalid user ID',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'NOT_FOUND',
                    message: "User with id '999' not found",
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user',
        description: 'Update user details (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUserRequest' },
              example: {
                name: 'Updated Name',
                email: 'newemail@example.com',
                role: 'admin',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'User updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserResponse' },
                example: {
                  data: {
                    id: 1,
                    email: 'newemail@example.com',
                    name: 'Updated Name',
                    role: 'admin',
                    createdAt: '2026-02-08T10:00:00Z',
                    updatedAt: '2026-02-08T11:30:00Z',
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'Forbidden - admin only',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        description: 'Delete user account (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        responses: {
          204: {
            description: 'User deleted successfully',
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          403: {
            description: 'Forbidden - admin only',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List posts',
        description: 'List posts (public: published only, authenticated: own posts + published)',
        security: [{ bearerAuth: [] }, {}],
        responses: {
          200: {
            description: 'List of posts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostsListResponse' },
                example: {
                  data: [
                    {
                      id: 1,
                      title: 'My First Post',
                      content: 'This is the content of my first post.',
                      published: true,
                      authorId: 2,
                      createdAt: '2026-02-08T10:30:00Z',
                      updatedAt: '2026-02-08T10:30:00Z',
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Create a post',
        description: 'Create a new post (authenticated users)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePostRequest' },
              example: {
                title: 'My New Post',
                content: 'Content goes here.',
                published: false,
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Post created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostResponse' },
                example: {
                  data: {
                    id: 1,
                    title: 'My New Post',
                    content: 'Content goes here.',
                    published: false,
                    authorId: 2,
                    createdAt: '2026-02-08T12:00:00Z',
                    updatedAt: '2026-02-08T12:00:00Z',
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
                example: {
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: [
                      { path: 'body.title', message: 'Required' },
                    ],
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['Posts'],
        summary: 'Get post by ID',
        description: 'Retrieve post by ID (public if published, owner if draft)',
        security: [{ bearerAuth: [] }, {}],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Post ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: 'Post details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostResponse' },
                example: {
                  data: {
                    id: 1,
                    title: 'My First Post',
                    content: 'This is the content.',
                    published: true,
                    authorId: 2,
                    createdAt: '2026-02-08T10:30:00Z',
                    updatedAt: '2026-02-08T10:30:00Z',
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request - invalid post ID',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Post not found or is draft (security: do not reveal existence)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: {
                    code: 'NOT_FOUND',
                    message: "Post with id '999' not found",
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Posts'],
        summary: 'Update post',
        description: 'Update own post (authenticated, owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Post ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePostRequest' },
              example: {
                title: 'Updated Title',
                content: 'Updated content.',
                published: true,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Post updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostResponse' },
                example: {
                  data: {
                    id: 1,
                    title: 'Updated Title',
                    content: 'Updated content.',
                    published: true,
                    authorId: 2,
                    createdAt: '2026-02-08T12:00:00Z',
                    updatedAt: '2026-02-08T12:30:00Z',
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Post not found or not owned by user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Delete post',
        description: 'Delete own post (authenticated, owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Post ID',
            schema: { type: 'integer' },
            example: 1,
          },
        ],
        responses: {
          204: {
            description: 'Post deleted successfully',
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Post not found or not owned by user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /auth/register or /auth/login',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server authentication',
      },
    },
    schemas: {
      // Health Response
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number', description: 'Uptime in seconds' },
          environment: { type: 'string', enum: ['development', 'staging', 'production'] },
          services: {
            type: 'object',
            properties: {
              database: { type: 'string', enum: ['healthy', 'unhealthy'] },
            },
          },
        },
        required: ['status', 'timestamp', 'uptime'],
      },
      
      // User Schema
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          name: { type: 'string', example: 'John Doe' },
          role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt'],
      },
      
      // Post Schema
      Post: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', minLength: 1, maxLength: 200, example: 'My Blog Post' },
          content: { type: 'string', minLength: 1, example: 'Post content goes here.' },
          published: { type: 'boolean', default: false, example: true },
          authorId: { type: 'integer', example: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'title', 'content', 'published', 'authorId', 'createdAt', 'updatedAt'],
      },
      
      // Request Schemas
      RegisterRequest: {
        type: 'object',
        required: ['email', 'name', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          name: { type: 'string', minLength: 1, example: 'Alice Smith' },
          password: { type: 'string', minLength: 8, example: 'SecurePassword123!' },
        },
      },
      
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          password: { type: 'string', example: 'SecurePassword123!' },
        },
      },
      
      CreatePostRequest: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, example: 'My New Post' },
          content: { type: 'string', minLength: 1, example: 'Content goes here.' },
          published: { type: 'boolean', default: false, example: false },
        },
      },
      
      UpdatePostRequest: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, example: 'Updated Title' },
          content: { type: 'string', minLength: 1, example: 'Updated content.' },
          published: { type: 'boolean', example: true },
        },
      },
      
      UpdateUserRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, example: 'Updated Name' },
          email: { type: 'string', format: 'email', example: 'newemail@example.com' },
          role: { type: 'string', enum: ['user', 'admin'], example: 'admin' },
        },
      },
      
      // Response Schemas
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'JWT access token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
        required: ['user', 'token'],
      },
      
      UserResponse: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/User' },
        },
        required: ['data'],
      },
      
      UsersListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
          },
        },
        required: ['data'],
      },
      
      PostResponse: {
        type: 'object',
        properties: {
          data: { $ref: '#/components/schemas/Post' },
        },
        required: ['data'],
      },
      
      PostsListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Post' },
          },
        },
        required: ['data'],
      },
      
      // Error Schemas
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { 
                type: 'string', 
                enum: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR'],
                example: 'NOT_FOUND',
              },
              message: { type: 'string', example: 'Resource not found' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
      
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: ['VALIDATION_ERROR'], example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Request validation failed' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', example: 'body.email' },
                    message: { type: 'string', example: 'Invalid email' },
                  },
                },
              },
            },
            required: ['code', 'message', 'details'],
          },
        },
        required: ['error'],
      },
    },
  },
} as const;
