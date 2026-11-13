<!-- @module:billing -->
<script lang="ts">
  import { DISPLAY_STATUS_LABEL, type InvoiceDisplayStatus } from '../../lib/invoiceStatus';

  export let status: InvoiceDisplayStatus;

  const CLASS: Record<InvoiceDisplayStatus, string> = {
    draft: '',
    sent: 'et-badge-blue',
    overdue: 'et-badge-red',
    paid: 'et-badge-green',
  };
</script>

<span class="et-badge {CLASS[status]}">{DISPLAY_STATUS_LABEL[status]}</span>
