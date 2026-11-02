import { MESHCORE_DATA_TYPE } from '@tesel/protocol';

/** `data_type` of the datagrams Tesel sends (protocol §7.1). */
export const SEND_DATA_TYPE = MESHCORE_DATA_TYPE;

/**
 * `data_type` values accepted as Tesel events. When a permanent value is registered it becomes
 * SEND_DATA_TYPE and the development value stays here for a transition period.
 */
export const ACCEPTED_DATA_TYPES: readonly number[] = [MESHCORE_DATA_TYPE];
