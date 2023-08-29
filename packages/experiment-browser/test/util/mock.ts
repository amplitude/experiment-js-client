let storage = {};

export const mockStorage = () => {
  Storage.prototype.getItem = jest.fn((key) => storage[key]);
  Storage.prototype.setItem = jest.fn((key, value) => {
    storage[key] = value;
  });
  Storage.prototype.removeItem = jest.fn((key) => delete storage[key]);
  Storage.prototype.clear = jest.fn(() => {
    storage = {};
  });
};
