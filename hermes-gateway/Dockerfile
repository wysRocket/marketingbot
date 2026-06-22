FROM nousresearch/hermes-agent:latest

# Railway has no interactive stdin. The upstream image otherwise falls back to
# a shell and exits, so make the Gateway process explicit and persistent.
CMD ["gateway", "run"]
