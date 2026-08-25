export const USER_ROLES = ["client", "staff_receiver", "staff_packer", "admin", "super_admin"] as const;

export const SUPPORTED_PRODUCT_PROVIDERS = ["alibaba1688", "taobao"] as const;

export const ORDER_STATUSES = [
  "pending_admin_review",
  "confirmed",
  "queued_for_purchase",
  "purchased",
  "seller_shipped",
  "received_china",
  "qc_checked",
  "packed",
  "sent_guangzhou",
  "arrived_guangzhou",
  "sent_bangladesh",
  "arrived_bangladesh",
  "ready_for_pickup",
  "completed",
  "cancelled",
  "exception"
] as const;

export const QC_STATUSES = ["pending", "pass", "fail", "partial", "missing", "admin_approved"] as const;

export const WALLET_TRANSACTION_TYPES = [
  "advance_credit",
  "order_debit",
  "refund",
  "adjustment",
  "reservation",
  "reservation_release"
] as const;

export const WALLET_RESERVATION_STATUSES = ["reserved", "reserved_or_partial", "insufficient_balance"] as const;
