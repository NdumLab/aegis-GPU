/**
 * BEGINNER LEARNING MODULE
 * Aggregates split learning-guide data chunks.
 */

window.AEGIS_LEARNING = Object.assign(
  {},
  window.AEGIS_LEARNING_PARTS?.hardware_foundations || {},
  window.AEGIS_LEARNING_PARTS?.platform_operations || {}
);
