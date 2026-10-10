/**
 * Taproot Kit — crafted primitives for Taproot's AI answers.
 * Adapted in spirit from Beautiful UI (MIT, © 2026 Shane Levine) and
 * rebuilt in the Public Record language: ruled registers, mono IDs, and
 * reduced-motion support throughout. Gallery: /#/kit
 */
export { DropGrid, DropLoader, RecordLoader, type DropLoaderProps, type DropLoaderVariant } from './drop-loader';
export { ThinkingTrace, type ThinkingTraceProps, type TraceStep } from './thinking-trace';
export { CitePill, Favicon, SourceList, SourceRegister, SourceStack, SourceToggle, hostOf, tagOf, type SourceItem } from './source-stack';
export { FollowUpList, type FollowUpListProps } from './follow-up-list';
export { ClarifyCard, type ClarifyCardProps, type ClarifyOption } from './clarify-card';
export { RecordChips, type RecordChip } from './record-chips';
export { formatElapsed, prefersReducedMotion, useElapsed, useReducedMotion, useStages } from './motion';
