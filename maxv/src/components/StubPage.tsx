import type { JSX } from 'react';
import { useMatches } from '@tanstack/react-router';
import { ComingSoon } from './ComingSoon';

/** Trang stub chung: lấy tiêu đề/mô tả từ staticData của route hiện tại. */
export function StubPage(): JSX.Element {
  const match = useMatches().at(-1);
  return (
    <ComingSoon
      title={match?.staticData.title ?? ''}
      description={match?.staticData.description}
    />
  );
}
