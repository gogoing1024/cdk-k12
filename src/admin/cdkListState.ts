export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 50

export function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), getPageCount(total, pageSize))
}

export function getPageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, items.length, pageSize)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function getPageRange(total: number, page: number, pageSize: number): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 }
  const safePage = clampPage(page, total, pageSize)
  return {
    start: (safePage - 1) * pageSize + 1,
    end: Math.min(safePage * pageSize, total),
  }
}

export function removeItemsById<T extends { id: string }>(items: T[], ids: Iterable<string>): T[] {
  const idSet = new Set(ids)
  if (idSet.size === 0) return items
  return items.filter(item => !idSet.has(item.id))
}

export function prependItems<T>(items: T[], newItems: T[]): T[] {
  if (newItems.length === 0) return items
  return [...newItems, ...items]
}
