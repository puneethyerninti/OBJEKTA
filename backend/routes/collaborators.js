const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json([{ id: "u1", name: "Demo User", role: "Artist" }]);
});

module.exports = router;
