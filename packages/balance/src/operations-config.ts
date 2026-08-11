export type OperationsConfig = {
  expansionDesignDaysBySize: Readonly<Record<24 | 32 | 36, number>>;
  scheduledPolicyLeadDays: number;
  emergencyPolicyLeadDays: number;
  standardSetLimit: number;
};

export const OPERATIONS_CONFIG: OperationsConfig = {
  expansionDesignDaysBySize: {
    24: 4,
    32: 6,
    36: 8,
  },
  scheduledPolicyLeadDays: 3,
  emergencyPolicyLeadDays: 1,
  standardSetLimit: 5,
};
