import { routePaths } from './routePaths'

// Only management categories backed by existing Backend contracts. No reservation-wide Admin API.
export const adminSections = [
  {
    path: 'accommodations',
    label: '숙소 관리',
    description: '숙소 등록, 정보 수정 및 운영 상태를 관리하는 영역입니다.',
  },
  {
    path: 'rooms',
    label: '객실 관리',
    description: '숙소에 속한 객실 등록, 정보 수정 및 운영 상태를 관리하는 영역입니다.',
  },
  {
    path: 'prices',
    label: '가격 관리',
    description: '객실과 숙박일을 기준으로 날짜별 가격을 등록·수정하는 영역입니다.',
  },
  {
    path: 'inventories',
    label: '재고 관리',
    description: '객실의 날짜별 재고, 판매 상태 및 기간별 재고 Calendar를 관리하는 영역입니다.',
  },
] as const

export type AdminSection = (typeof adminSections)[number]

export function adminSectionPath(section: AdminSection): string {
  return `${routePaths.admin}/${section.path}`
}
