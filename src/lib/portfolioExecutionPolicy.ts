import type { FitnessExperimentOptions, FitnessPolicy } from "../types/index.ts";

/** Shared defaults for initial generation, live rebalance and backtest series. */
export const DEFAULT_FITNESS_POLICY: FitnessPolicy = "legacy_cvar_v1";
export const executionOptions = (fitness: FitnessPolicy = DEFAULT_FITNESS_POLICY, guarded = false): FitnessExperimentOptions & { rebalance_model: "legacy" | "guarded_v1" } => ({
  fitness_policy: fitness,
  rebalance_model: guarded ? "guarded_v1" : "legacy",
  charge_transaction_fees: true,
  fitness_horizon_days: 63,
  fitness_cvar_tail_fraction: .1,
  fitness_lambda_cvar: .5,
  rebalance_buy_fee_rate: .0015,
  rebalance_sell_fee_rate: .0025,
});
