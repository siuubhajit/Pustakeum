use parking_lot::RwLock;
use std::collections::HashMap;

lazy_static::lazy_static! {
    pub static ref GLOBAL_PAGE_BUFFER: PageRingBuffer = PageRingBuffer::new(128 * 1024 * 1024); // 128MB cache
}

pub struct PageRingBuffer {
    max_capacity_bytes: usize,
    allocated_bytes: RwLock<usize>,
    frames: RwLock<HashMap<String, Vec<u8>>>,
}

impl PageRingBuffer {
    pub fn new(max_capacity_bytes: usize) -> Self {
        Self {
            max_capacity_bytes,
            allocated_bytes: RwLock::new(0),
            frames: RwLock::new(HashMap::new()),
        }
    }

    pub fn store(&self, frame_id: &str, data: &[u8]) {
        let mut frames = self.frames.write();
        let mut allocated = self.allocated_bytes.write();

        // Evict older framebuffers if capacity threshold is exceeded
        while *allocated + data.len() > self.max_capacity_bytes && !frames.is_empty() {
            let oldest_key = frames.keys().next().cloned().unwrap();
            if let Some(evicted) = frames.remove(&oldest_key) {
                *allocated = allocated.saturating_sub(evicted.len());
            }
        }

        frames.insert(frame_id.to_string(), data.to_vec());
        *allocated += data.len();
    }

    pub fn read(&self, frame_id: &str) -> Option<Vec<u8>> {
        self.frames.read().get(frame_id).cloned()
    }

    pub fn clear(&self) {
        let mut frames = self.frames.write();
        let mut allocated = self.allocated_bytes.write();
        frames.clear();
        *allocated = 0;
    }
}

