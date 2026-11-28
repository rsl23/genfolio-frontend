import type { FitnessExperimentOptions } from "../types/index.ts";

/** Shared defaults for initial generation, live rebalance and backtest series. */
export const executionOptions = (): FitnessExperimentOptions => ({
  profile_policy: "composition_v2",
  fitness_policy: "legacy_cvar_v1",
  charge_transaction_fees: true,
  fitness_horizon_days: 63,
  fitness_cvar_tail_fraction: .1,
  fitness_lambda_cvar: .5,
  rebalance_buy_fee_rate: .0015,
  rebalance_sell_fee_rate: .0025,
});
