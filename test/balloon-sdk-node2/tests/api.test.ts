const V2Api = require('../src/api').V2Api;
jest.mock('request');

describe('core api v2', () => {
  describe('users api', () => {
    it('Get all users', () => {
      var client = new V2Api();
      var response = client.getUsers();
    });
  });
});
