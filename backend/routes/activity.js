const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json([{ id: 1, text: "Created project", when: "Today" }]);
});

module.exports = router;
