import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clickable } from '../a11y.js';

const keyEvent = (key: string) => {
  let prevented = false;
  return {
    key,
    preventDefault() { prevented = true; },
    get defaultPrevented() { return prevented; },
  } as any;
};

test('clickable exposes button semantics', () => {
  const props = clickable(() => {});
  assert.equal(props.role, 'button');
  assert.equal(props.tabIndex, 0);
});

test('clickable activates on click, Enter, and Space', () => {
  let count = 0;
  const props = clickable(() => { count++; });
  props.onClick();
  props.onKeyDown(keyEvent('Enter'));
  props.onKeyDown(keyEvent(' '));
  assert.equal(count, 3);
});

test('Space activation prevents page scroll', () => {
  const props = clickable(() => {});
  const e = keyEvent(' ');
  props.onKeyDown(e);
  assert.equal(e.defaultPrevented, true);
});

test('other keys do not activate', () => {
  let count = 0;
  const props = clickable(() => { count++; });
  props.onKeyDown(keyEvent('a'));
  props.onKeyDown(keyEvent('Escape'));
  assert.equal(count, 0);
});

test('disabled blocks activation and removes from tab order', () => {
  let count = 0;
  const props = clickable(() => { count++; }, { disabled: true });
  assert.equal(props.tabIndex, -1);
  assert.equal(props['aria-disabled'], true);
  props.onClick();
  props.onKeyDown(keyEvent('Enter'));
  assert.equal(count, 0);
});

test('label is exposed as aria-label', () => {
  const props = clickable(() => {}, { label: 'Open item' });
  assert.equal(props['aria-label'], 'Open item');
});
