import { ExperimentUser } from '../src/types/user';
import { convertUserToContext } from '../src/util/convert';

describe('convertUserToContext', () => {
  describe('groups', () => {
    test('undefined user', () => {
      const user: ExperimentUser | undefined = undefined;
      const context = convertUserToContext(user);
      expect(context).toEqual({});
    });
    test('undefined groups', () => {
      const user: ExperimentUser = {};
      const context = convertUserToContext(user);
      expect(context).toEqual({ user: {} });
    });
    test('empty groups', () => {
      const user: ExperimentUser = { groups: {} };
      const context = convertUserToContext(user);
      expect(context).toEqual({ user: {} });
    });
    test('groups and group_properties removed from user', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: {},
        group_properties: {},
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({ user: { user_id: 'user_id' } });
    });
    test('user groups, undefined group properties, moved under context groups', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1'] },
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: { gt1: { group_name: 'gn1' } },
      });
    });
    test('user groups, empty group properties, moved under context groups', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1'] },
        group_properties: {},
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: { gt1: { group_name: 'gn1' } },
      });
    });
    test('user groups, group properties empty group type object, moved under context groups', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1'] },
        group_properties: { gt1: {} },
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: { gt1: { group_name: 'gn1' } },
      });
    });
    test('user groups, group properties empty group name object, moved under context groups', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1'] },
        group_properties: { gt1: { gn1: {} } },
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: { gt1: { group_name: 'gn1' } },
      });
    });
    test('user groups, with group properties, moved under context groups', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1'] },
        group_properties: { gt1: { gn1: { gp1: 'gp1' } } },
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: {
          gt1: { group_name: 'gn1', group_properties: { gp1: 'gp1' } },
        },
      });
    });
    test('user groups and group properties, with multiple group names, takes first', () => {
      const user: ExperimentUser = {
        user_id: 'user_id',
        groups: { gt1: ['gn1', 'gn2'] },
        group_properties: { gt1: { gn1: { gp1: 'gp1' }, gn2: { gp2: 'gp2' } } },
      };
      const context = convertUserToContext(user);
      expect(context).toEqual({
        user: { user_id: 'user_id' },
        groups: {
          gt1: { group_name: 'gn1', group_properties: { gp1: 'gp1' } },
        },
      });
    });
  });
});
