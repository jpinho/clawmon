import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_CATEGORIES, getRole, getRolesByCategory, formatRoleList } from './roles.js';

describe('roles', () => {
  it('every role has a valid category', () => {
    const categoryIds = ROLE_CATEGORIES.map(c => c.id);
    for (const role of ROLES) {
      expect(categoryIds).toContain(role.category);
    }
  });

  it('every role has all required fields non-empty', () => {
    for (const role of ROLES) {
      expect(role.id).toBeTruthy();
      expect(role.name).toBeTruthy();
      expect(role.description).toBeTruthy();
      expect(role.whatItDoes).toBeTruthy();
      expect(role.cadence).toBeTruthy();
      expect(role.exampleMessage).toBeTruthy();
    }
  });

  it('role IDs are unique', () => {
    const ids = ROLES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getRole returns correct role by ID', () => {
    const role = getRole('financial-advisor');
    expect(role).toBeDefined();
    expect(role!.name).toBe('The Financial Advisor');
  });

  it('getRole returns undefined for unknown ID', () => {
    expect(getRole('nonexistent')).toBeUndefined();
  });

  it('getRolesByCategory returns only roles from that category', () => {
    const innerRoles = getRolesByCategory('inner');
    expect(innerRoles.length).toBeGreaterThan(0);
    for (const role of innerRoles) {
      expect(role.category).toBe('inner');
    }
  });

  it('all roles are reachable via getRolesByCategory', () => {
    let total = 0;
    for (const cat of ROLE_CATEGORIES) {
      total += getRolesByCategory(cat.id).length;
    }
    expect(total).toBe(ROLES.length);
  });

  it('formatRoleList includes all categories', () => {
    const list = formatRoleList();
    for (const cat of ROLE_CATEGORIES) {
      expect(list).toContain(cat.name);
    }
  });
});
