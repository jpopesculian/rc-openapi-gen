export default {
  Buffer: {
    id: "Buffer",
    type: "string",
    format: "byte"
  },
  CSV: {
    id: "CSV",
    type: "string",
    format: "csv"
  },
  ID: {
    id: "ID",
    type: "string",
    format: "id",
    minLength: 1,
    maxLength: 20
  },
  TransactionQuery: {
    id: "TransactionQuery",
    type: "object",
    properties: {
      transaction: { type: "object" },
      transactions: { type: "array", maxItems: 10 }
    }
  }
};
