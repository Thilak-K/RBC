module.exports = {
    STATUS: {
      PENDING: "pending",
      COMPLETED: "completed",
    },
    MULTER_LIMITS: {
      fileSize: 20 * 1024 * 1024, 
    },
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/jpg"],
    CACHE_TTL: 3600,
    API_VERSION: "/v1",
  };