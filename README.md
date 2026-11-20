# Homing Pigeon

Homing Pigeon (homingpigeon.dev) sends text-message alerts from your code or your coding agent to one phone: yours. No carrier registration, no app, no browser signup. Free to start.

This action texts you from a GitHub Actions workflow: when a build fails, a deploy finishes or a scheduled job breaks.

```yaml
- name: Text me if this failed
  if: failure()
  uses: homingpigeondev/notify@v1
  with:
    message: "${{ github.workflow }} failed on ${{ github.ref_name }}"
    api-key: ${{ secrets.HOMINGPIGEON_API_KEY }}
```

## Setup

1. Verify your own phone and get a key. In a terminal, or ask your coding agent to do it:

   ```
   npx -y homingpigeondev verify +15551234567
   npx -y homingpigeondev verify +15551234567 123456
   ```

   The first command texts you a six-digit code. The second saves the key on your machine.

2. Save the key as a repository secret:

   ```
   npx -y homingpigeondev key | gh secret set HOMINGPIGEON_API_KEY
   ```

3. Add the step above to any job.

US mobile numbers only. The text goes only to the phone you verified, so there is no recipient to set.

## Examples

Text when any earlier step in the job fails:

```yaml
- if: failure()
  uses: homingpigeondev/notify@v1
  with:
    message: "${{ github.workflow }} failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
    api-key: ${{ secrets.HOMINGPIGEON_API_KEY }}
```

Text when a deploy finishes, once per run even if it is re-run:

```yaml
- uses: homingpigeondev/notify@v1
  with:
    message: "Deployed ${{ github.sha }} to production"
    api-key: ${{ secrets.HOMINGPIGEON_API_KEY }}
    idempotency-key: deploy-${{ github.run_id }}
```

Set the key once for every step in a job:

```yaml
jobs:
  nightly:
    runs-on: ubuntu-latest
    env:
      HOMINGPIGEON_API_KEY: ${{ secrets.HOMINGPIGEON_API_KEY }}
    steps:
      - run: ./backup.sh
      - if: failure()
        uses: homingpigeondev/notify@v1
        with:
          message: Nightly backup failed
```

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `message` | yes | The text, up to 480 characters. It arrives as `[key name] message`. |
| `api-key` | no | Your key. Defaults to the `HOMINGPIGEON_API_KEY` environment variable. |
| `idempotency-key` | no | Reusing it stops a second text for the same event. |
| `fail-on-error` | no | `true` fails the step if the text cannot be sent. By default that is only a warning, so an alert never breaks your build. |

## Outputs

| Output | Description |
| --- | --- |
| `id` | The message id. |
| `status` | The message status, such as `queued`. |
| `messages-remaining` | Texts left this month. |

## Price

50 texts a month are free. After that, $19 a month for 1,000.

Docs for agents: https://homingpigeon.dev/llms.txt · Terms: https://homingpigeon.dev/terms
