/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import expensesRoute from '../../src/routes/expenses';

const { mockListExpenses, mockCreateExpense } = vi.hoisted(() => ({
  mockListExpenses: vi.fn(),
  mockCreateExpense: vi.fn(),
}));

vi.mock('../../src/services/expenses-service', () => ({
  listExpenses: mockListExpenses,
  createExpense: mockCreateExpense,
}));

describe('expenses route filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildApp = () => {
    let listHandler: any;
    const app: any = {
      authenticate: vi.fn(),
      get(path: string, _opts: any, handler: any) {
        if (path === '/expenses') listHandler = handler;
      },
      post: vi.fn(),
      register: vi.fn(),
    };
    return { app, getListHandler: () => listHandler };
  };

  it('calls service without filters when none provided', async () => {
    mockListExpenses.mockResolvedValueOnce({ data: [] });
    const { app, getListHandler } = buildApp();
    await expensesRoute(app);

    const handler = getListHandler();
    const response = await handler({
      user: { sub: '3' },
      query: {},
    });

    expect(mockListExpenses).toHaveBeenCalledWith(3, {
      vehicleId: undefined,
      from: undefined,
      to: undefined,
      category: undefined,
    });
    expect(response).toEqual({ data: [] });
  });

  it('parses filters and forward them to service', async () => {
    mockListExpenses.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const { app, getListHandler } = buildApp();
    await expensesRoute(app);

    const handler = getListHandler();
    const result = await handler({
      user: { sub: '8' },
      query: {
        vehicleId: '15',
        from: '2024-05-01',
        to: '2024-05-31',
        category: 'part',
      },
    });

    expect(mockListExpenses).toHaveBeenCalledWith(8, {
      vehicleId: 15,
      from: new Date('2024-05-01'),
      to: new Date('2024-05-31'),
      category: 'part',
    });
    expect(result).toEqual({ data: [{ id: 1 }] });
  });
});
