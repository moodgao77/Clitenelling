import { STAGE_META, type Stage } from '@/lib/types';

export default function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`stage-badge stage-${stage}`}>{STAGE_META[stage].label}</span>;
}
