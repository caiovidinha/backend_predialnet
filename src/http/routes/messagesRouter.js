const express = require('express');
const { validateJWT } = require('../middlewares/auth');
const ctrl = require('../controllers/messagesController');

const router = express.Router();

router.use(validateJWT);

router.post('/', ctrl.createMessageController);
router.get('/', ctrl.listMessagesController);
router.get('/:id', ctrl.getMessageController);
router.patch('/:id', ctrl.updateMessageController);
router.delete('/:id', ctrl.deleteMessageController);
router.post('/:id/targets', ctrl.addTargetController);
router.delete('/:id/targets/:targetId', ctrl.removeTargetController);
router.post('/:id/assign-by-address', ctrl.assignByAddressController);

module.exports = router;
