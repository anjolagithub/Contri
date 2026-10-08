import type { Address } from "viem";

export type CircleStatus = 0 | 1 | 2 | 3; // Open, Active, Done, Cancelled
export const STATUS = { Open: 0, Active: 1, Done: 2, Cancelled: 3 } as const;

export type Member = {
  account: Address;
  name: string;
  deposit: bigint;
  strikes: number;
  removed: boolean;
  received: boolean;
  paidThisRound: boolean;
};

export type Circle = {
  id: bigint;
  token: Address;
  creator: Address;
  contribution: bigint;
  deposit: bigint;
  period: number;
  deadline: number;
  size: number;
  round: number;
  activeCount: number;
  paidCount: number;
  status: CircleStatus;
  pot: bigint;
  name: string;
  members: Member[];
  /** marks[round][member]: 0 unpaid, 1 paid, 2 covered by deposit */
  marks: number[][];
};
