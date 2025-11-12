import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for testing
process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-test-key';
process.env.RESEND_API_KEY = 're_test_key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.AWS_S3_REGION = 'us-east-1';
process.env.CLERK_SECRET_KEY = 'sk_test_test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_test';
process.env.STRIPE_SECRET_KEY = 'sk_test_test';
process.env.SKIP_ENV_VALIDATION = 'true';

// Mock fetch globally
global.fetch = vi.fn();
