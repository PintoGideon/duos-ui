import React from 'react';
import { useEffect, useState } from 'react';
import { Notifications } from '../libs/utils';
import { DataSet } from '../libs/ajax';
import DatasetSearchTable from '../components/data_search/DatasetSearchTable';

export const DatasetSearch = (props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [datasets, setDatasets] = useState([]);

  useEffect(() => {
    const init = async () => {
      const query = {
        'query': {
          'bool': {
            'must': [
              {
                'match': {
                  '_type': 'dataset'
                }
              }
            ]
          }
        }
      };
      try {
        await DataSet.searchDatasetIndex(query).then((datasets) => {
          setDatasets(datasets);
        });
      } catch (error) {
        Notifications.showError({ text: 'Failed to load Elasticsearch index' });
      }
      setIsLoading(false);
    };
    init();
  }, []);

  return (
    <div>
      <DatasetSearchTable datasets={datasets} isLoading={isLoading} props={props} />
    </div>
  );
};

export default DatasetSearch;
