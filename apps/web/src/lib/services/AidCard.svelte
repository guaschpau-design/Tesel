<!-- In the panel of an aid point tapped (ADR-0165): what OpenStreetMap tells of it — where exactly
     a defibrillator is and when it can be reached, who may use it, what kind of hydrant it is. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { AidFacts } from './services.ts';

  interface Props {
    t: Translate;
    aid: AidFacts;
  }

  let { t, aid }: Props = $props();

  /** OpenStreetMap's `access` values a team needs read, in words; the rest as they are. */
  const ACCESS: Readonly<Record<string, MessageKey>> = {
    yes: 'aidAccessPublic',
    public: 'aidAccessPublic',
    permissive: 'aidAccessPublic',
    customers: 'aidAccessCustomers',
    private: 'aidAccessPrivate',
    no: 'aidAccessPrivate',
  };

  /** OpenStreetMap's `fire_hydrant:type` values, in words. */
  const HYDRANT: Readonly<Record<string, MessageKey>> = {
    pillar: 'hydrantPillar',
    underground: 'hydrantUnderground',
    wall: 'hydrantWall',
  };

  const words = (known: Readonly<Record<string, MessageKey>>, value: string) => {
    const key = known[value];
    return key === undefined ? value : t(key);
  };
</script>

{#if aid.where !== null}
  <p class="line"><strong>{t('aidWhere')}</strong> {aid.where}</p>
{/if}
{#if aid.hours !== null}
  <p class="line">
    <strong>{t('aidHours')}</strong>
    {aid.hours === '24/7' ? t('aidAlways') : aid.hours}
  </p>
{/if}
{#if aid.access !== null}
  <p class="line"><strong>{t('aidAccess')}</strong> {words(ACCESS, aid.access)}</p>
{/if}
{#if aid.type !== null}
  <p class="line"><strong>{t('aidType')}</strong> {words(HYDRANT, aid.type)}</p>
{/if}

<style>
  .line {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
    align-items: baseline;
    margin: 0;
  }
</style>
