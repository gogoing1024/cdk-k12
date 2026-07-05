import {
  clampPage,
  getPageCount,
  getPageItems,
  getPageRange,
  prependItems,
  removeItemsById,
} from '../src/admin/cdkListState.js'

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`)
  }
}

function assertArrayEqual<T>(actual: T[], expected: T[]): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const items = Array.from({ length: 55 }, (_, index) => index + 1)

assertEqual(getPageCount(0, 20), 1)
assertEqual(getPageCount(55, 20), 3)
assertEqual(clampPage(5, 55, 20), 3)
assertEqual(clampPage(0, 55, 20), 1)
assertArrayEqual(getPageItems(items, 2, 20), items.slice(20, 40))

assertEqual(getPageRange(55, 1, 20).start, 1)
assertEqual(getPageRange(55, 1, 20).end, 20)
assertEqual(getPageRange(55, 3, 20).start, 41)
assertEqual(getPageRange(55, 3, 20).end, 55)
assertEqual(getPageRange(0, 1, 20).start, 0)
assertEqual(getPageRange(0, 1, 20).end, 0)

const keyedItems = [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
  { id: 'c', value: 3 },
]
assertArrayEqual(removeItemsById(keyedItems, ['a', 'c']).map(item => item.id), ['b'])
assertArrayEqual(removeItemsById(keyedItems, []).map(item => item.id), ['a', 'b', 'c'])
assertArrayEqual(
  prependItems(keyedItems, [{ id: 'new-1', value: 10 }, { id: 'new-2', value: 11 }]).map(item => item.id),
  ['new-1', 'new-2', 'a', 'b', 'c']
)

console.log('cdkListState tests passed')
