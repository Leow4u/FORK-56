import { atom } from "nanostores";

export function openReviewForPath(_path: string): void {}
export function revealReview(): void {}

export const $reviewOpen = atom(false);
