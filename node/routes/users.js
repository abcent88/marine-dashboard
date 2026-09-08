const express = require("express");
const userCreateRouter = require("./user-create");
const userUpdateRouter = require("./user-update");
const userPasswordRouter = require("./user-password");
const userDeleteRouter = require("./user-delete");
const userListRouter = require("./user-list");

const router = express.Router();

router.use(userCreateRouter);
router.use(userUpdateRouter);
router.use(userPasswordRouter);
router.use(userDeleteRouter);
router.use(userListRouter);





module.exports = router;
