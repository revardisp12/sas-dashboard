import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'
import { render, fireEvent } from '@testing-library/react'
import SearchableCombobox from './SearchableCombobox'

describe('SearchableCombobox (allowFreeText)', () => {
  it('commits a freshly-typed value on click-outside, not a stale empty query', () => {
    const onChange = vi.fn()
    const { getByPlaceholderText } = render(
      <SearchableCombobox value="" onChange={onChange} allowFreeText options={[]} placeholder="Produk" />,
    )
    const input = getByPlaceholderText('Produk')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Paket Hemat 3pcs' } })
    fireEvent.mouseDown(document.body)
    expect(onChange).toHaveBeenCalledWith('Paket Hemat 3pcs')
  })

  it('preserves the edited value on click-outside instead of wiping it', () => {
    const onChange = vi.fn()
    const { getByDisplayValue } = render(
      <SearchableCombobox value="Serum" onChange={onChange} allowFreeText options={[]} />,
    )
    const input = getByDisplayValue('Serum')
    fireEvent.focus(input)
    fireEvent.mouseDown(document.body)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not wipe an existing value on an unrelated click elsewhere on the page when the field was never focused', () => {
    const onChange = vi.fn()
    render(<SearchableCombobox value="Serum" onChange={onChange} allowFreeText options={[]} />)
    // No focus/interaction with the combobox at all — simulates clicking e.g. "Simpan".
    fireEvent.mouseDown(document.body)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts free text that matches no option', () => {
    const onChange = vi.fn()
    const { getByPlaceholderText } = render(
      <SearchableCombobox
        value=""
        onChange={onChange}
        allowFreeText
        options={[{ value: 'Brightening Serum', label: 'Brightening Serum' }]}
        placeholder="Produk"
      />,
    )
    const input = getByPlaceholderText('Produk')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Bundle Baru' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Bundle Baru')
  })
})

describe('SearchableCombobox (strict select mode)', () => {
  const options = [
    { value: 'inf-1', label: 'Nurfatma Sari — @nurfatma_ig (Instagram)' },
    { value: 'inf-2', label: 'Nurfatma Sari — @nurfatma_tt (TikTok)' },
  ]

  it('commits the picked option value on click', () => {
    const onChange = vi.fn()
    const { getByPlaceholderText, getByText } = render(
      <SearchableCombobox value="" onChange={onChange} options={options} placeholder="Cari influencer" emptyLabel="— Tidak ada —" />,
    )
    fireEvent.focus(getByPlaceholderText('Cari influencer'))
    fireEvent.mouseDown(getByText('Nurfatma Sari — @nurfatma_tt (TikTok)'))
    expect(onChange).toHaveBeenCalledWith('inf-2')
  })

  it('reverts to the last valid selection instead of committing unmatched typed text', () => {
    const onChange = vi.fn()
    const { getByDisplayValue } = render(
      <SearchableCombobox value="inf-1" onChange={onChange} options={options} emptyLabel="— Tidak ada —" />,
    )
    const input = getByDisplayValue('Nurfatma Sari — @nurfatma_ig (Instagram)')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'asdkjaskdj' } })
    fireEvent.mouseDown(document.body)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the selection via the empty option', () => {
    const onChange = vi.fn()
    const { getByDisplayValue, getByText } = render(
      <SearchableCombobox value="inf-1" onChange={onChange} options={options} emptyLabel="— Tidak ada —" />,
    )
    fireEvent.focus(getByDisplayValue('Nurfatma Sari — @nurfatma_ig (Instagram)'))
    fireEvent.mouseDown(getByText('— Tidak ada —'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
