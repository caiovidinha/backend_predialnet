const standardUserApp = [
  {
    id: 1,
    cpf: "19242536742",
    cNumber: "012345",
    password: "!xNQ5oFkRa>>nc",
  },
  {
    id: 2,
    cpf: "85937201459",
    cNumber: "678901",
    password: "Pa$$w0rd1!",
  },
  {
    id: 3,
    cpf: "47382910568",
    cNumber: "234567",
    password: "S3cureP@ss",
  },
  {
    id: 4,
    cpf: "09128374655",
    cNumber: "890123",
    password: "MyP@ssw0rd!",
  },
];

const getUser = (id) => {
  for (let user of standardUserApp) {
    if (user.id == id) {
      return user;
    }
  }
  return false;
};

const getPassword = (id) => {
  for (let user of standardUserApp) {
    if (user.id == id) {
      return user.password;
    }
  }
  return false;
};

module.exports = {
  getUser,
  getPassword,
};
