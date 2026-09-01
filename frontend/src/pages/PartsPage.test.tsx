import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PartsPage from './PartsPage'
import { getParts, getSuppliers } from '../api/endpoints'

vi.mock('../api/endpoints', () => ({
  getParts: vi.fn(),
  getSuppliers: vi.fn(),
  createPart: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePart: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'admin@partspulse.io', role: 'admin' } }),
}))

describe('PartsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSuppliers).mockResolvedValue([])
    vi.mocked(getParts).mockResolvedValue({
      items: [
        {
          id: 1,
          name: 'Ball Bearing 6202-ZZ',
          sku: 'BRG-6202',
          current_stock: 5,
          reorder_threshold: 20,
          unit_price: '3.50',
          supplier_id: 1,
          is_low_stock: true,
          created_at: '2026-08-31T00:00:00Z',
          updated_at: '2026-08-31T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    })
  })

  it('renders the low-stock badge for a part below its reorder threshold', async () => {
    render(<PartsPage />)
    expect(await screen.findByText('low stock')).toBeInTheDocument()
    expect(screen.getByText('Ball Bearing 6202-ZZ')).toBeInTheDocument()
  })
})
