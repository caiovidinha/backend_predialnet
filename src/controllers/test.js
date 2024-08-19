const loading = async (req, res) => {
  const time = req.params.time;
  setTimeout(() => {
    res.status(201).json({ loaded: true });
  }, time);
};

module.exports = {
  loading,
};
