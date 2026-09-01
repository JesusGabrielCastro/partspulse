import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RequestPoModal } from './PartsPage'
import type { Part } from '../types'
import { createPurchaseOrder } from '../api/endpoints'

vi.mock('../api/endpoints', () => ({
  createPurchaseOrder: vi.fn(),
}))

const part: Part = {
  id: 9,
  name: 'Pressure Sensor PS-200',
  sku: 'SEN-PS200',
  current_stock: 2,
  reorder_threshold: 6,
  unit_price: '45.00',
  supplier_id: 3,
  is_low_stock: true,
  created_at: '2026-08-31T00:00:00Z',
  updated_at: '2026-08-31T00:00:00Z',
}

describe('RequestPoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a validation error for a non-positive quantity', async () => {
    render(<RequestPoModal part={part} onClose={() => {}} onDone={() => {}} />)

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    expect(await screen.findByText('Quantity must be a positive whole number.')).toBeInTheDocument()
    expect(createPurchaseOrder).not.toHaveBeenCalled()
  })

  it('submits a valid quantity and calls createPurchaseOrder', async () => {
    const onDone = vi.fn()
    vi.mocked(createPurchaseOrder).mockResolvedValue({} as never)

    render(<RequestPoModal part={part} onClose={() => {}} onDone={onDone} />)

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => expect(createPurchaseOrder).toHaveBeenCalledWith(9, 5))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
