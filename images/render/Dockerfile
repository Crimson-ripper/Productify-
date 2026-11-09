# Productify rendering: Vast's GPU desktop (opens in the browser) with Blender LTS, for GPU (Cycles/OptiX)
# and command-line rendering. Blender is GPL; the desktop image is Vast's official one.
FROM vastai/linux-desktop:cuda-12.9-ubuntu24.04-2026-10-23

ARG BLENDER_VERSION=5.2.3
ARG BLENDER_SERIES=5.2
USER root
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libsm6 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://download.blender.org/release/Blender${BLENDER_SERIES}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -o /tmp/blender.tar.xz \
 && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 && rm /tmp/blender.tar.xz \
 && ln -sf /opt/blender/blender /usr/local/bin/blender \
 && mkdir -p /usr/share/applications \
 && cp /opt/blender/blender.desktop /usr/share/applications/blender.desktop 2>/dev/null; \
    sed -i 's#^Exec=.*#Exec=/opt/blender/blender %f#; s#^Icon=.*#Icon=/opt/blender/blender.svg#' /usr/share/applications/blender.desktop 2>/dev/null; \
    blender --version | head -1
LABEL org.opencontainers.image.source="https://github.com/Crimson-ripper/Productify-" \
      org.opencontainers.image.description="Productify rendering: GPU desktop with Blender LTS"
