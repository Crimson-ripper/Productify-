# Productify AI development: PyTorch + CUDA with JupyterLab and the Productify agent pre-installed,
# so a rented machine is ready without installing anything on first boot.
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

ARG AGENT_URL=https://github.com/Crimson-ripper/Productify-Node/releases/download/v2.2.0-beta.1/productify-agent-linux-amd64
RUN pip install --no-cache-dir jupyterlab==4.4.* ipywidgets \
 && python3 -c "import urllib.request; urllib.request.urlretrieve('${AGENT_URL}', '/usr/local/bin/productify-agent')" \
 && chmod +x /usr/local/bin/productify-agent \
 && mkdir -p /workspace
WORKDIR /workspace
LABEL org.opencontainers.image.source="https://github.com/Crimson-ripper/Productify-" \
      org.opencontainers.image.description="Productify AI development: PyTorch, CUDA and JupyterLab"
